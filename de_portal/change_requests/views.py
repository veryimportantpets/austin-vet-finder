from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import HttpResponse, Http404
from django.views.decorators.http import require_POST

from orgs.middleware import get_user_projects, user_can_access_project
from .models import ChangeRequest


@login_required
def change_request_list(request, pk=None):
    """List change requests for a project."""
    user = request.user

    if pk:
        from projects.models import Project
        project = get_object_or_404(Project, pk=pk)
        if not user_can_access_project(user, project):
            raise Http404()
        change_requests = ChangeRequest.objects.filter(project=project)
    else:
        projects = get_user_projects(user).filter(status='active')
        project = projects.first()
        if not project:
            return render(request, 'portal/no_project.html')
        change_requests = ChangeRequest.objects.filter(project=project)

    return render(request, 'portal/change_requests.html', {
        'project': project,
        'change_requests': change_requests,
    })


@login_required
def change_request_detail(request, pk):
    """View a change request."""
    user = request.user
    cr = get_object_or_404(ChangeRequest.objects.select_related('project', 'requested_by'), pk=pk)

    if not user_can_access_project(user, cr.project):
        raise Http404()

    return render(request, 'portal/change_request_detail.html', {
        'cr': cr,
        'project': cr.project,
    })


@login_required
def create_change_request(request, pk=None):
    """Create a new change request."""
    user = request.user

    if pk:
        from projects.models import Project
        project = get_object_or_404(Project, pk=pk)
    else:
        projects = get_user_projects(user).filter(status='active')
        project = projects.first()

    if not project or not user_can_access_project(user, project):
        raise Http404()

    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        description = request.POST.get('description', '').strip()

        if title and description:
            cr = ChangeRequest.objects.create(
                project=project,
                requested_by=user,
                title=title,
                description=description
            )
            messages.success(request, 'Change request submitted.')
            return redirect('change_request_detail', pk=cr.pk)

    return render(request, 'portal/change_request_form.html', {
        'project': project,
    })


@login_required
@require_POST
def approve_change_request(request, pk):
    """Approve a change request (designer action)."""
    user = request.user
    cr = get_object_or_404(ChangeRequest.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, cr.project) or user.is_client:
        raise Http404()

    response = request.POST.get('response', '')
    cr.approve(user, response)
    messages.success(request, 'Change request approved.')
    return redirect('change_request_detail', pk=pk)


@login_required
@require_POST
def decline_change_request(request, pk):
    """Decline a change request (designer action)."""
    user = request.user
    cr = get_object_or_404(ChangeRequest.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, cr.project) or user.is_client:
        raise Http404()

    response = request.POST.get('response', '')
    cr.decline(user, response)
    messages.success(request, 'Change request declined.')
    return redirect('change_request_detail', pk=pk)


@login_required
@require_POST
def schedule_change_request(request, pk):
    """Schedule a change request (designer action)."""
    user = request.user
    cr = get_object_or_404(ChangeRequest.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, cr.project) or user.is_client:
        raise Http404()

    response = request.POST.get('response', '')
    cr.schedule(user, response)
    messages.success(request, 'Change request scheduled.')
    return redirect('change_request_detail', pk=pk)
