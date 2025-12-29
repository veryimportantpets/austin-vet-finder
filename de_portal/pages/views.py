from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import HttpResponse, Http404
from django.views.decorators.http import require_POST

from orgs.middleware import get_user_projects, user_can_access_project
from .models import Page
from cards.models import Card
from notifications.services import notify_page_ready_for_review, notify_page_approved_by_client


@login_required
def pages_list(request):
    """Client's pages list with review status."""
    user = request.user
    projects = get_user_projects(user).filter(status='active')
    project = projects.first()

    if not project:
        return render(request, 'portal/no_project.html')

    pages = project.pages.select_related('page_type').all()

    return render(request, 'portal/pages_list.html', {
        'project': project,
        'pages': pages,
    })


@login_required
def page_detail(request, pk):
    """Page detail with preview and review card."""
    user = request.user
    page = get_object_or_404(Page.objects.select_related('project', 'page_type'), pk=pk)

    if not user_can_access_project(user, page.project):
        raise Http404()

    # Get associated review card
    review_card = Card.objects.filter(
        project=page.project,
        page=page,
        kind='page_review'
    ).first()

    # Get content cards for this page
    content_cards = Card.objects.filter(
        project=page.project,
        page=page,
        kind='client_task'
    )

    context = {
        'page': page,
        'project': page.project,
        'review_card': review_card,
        'content_cards': content_cards,
    }
    return render(request, 'portal/page_detail.html', context)


@login_required
@require_POST
def ready_for_review(request, pk):
    """Mark page as ready for review (designer action)."""
    user = request.user
    page = get_object_or_404(Page.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, page.project) or user.is_client:
        raise Http404()

    preview_url = request.POST.get('preview_url', '')
    if preview_url:
        page.preview_url = preview_url
        page.save(update_fields=['preview_url'])

    review_card = page.mark_ready_for_review()

    # Notify client
    notify_page_ready_for_review(page)

    messages.success(request, f'"{page.title}" is now ready for client review.')

    if request.htmx:
        return render(request, 'portal/partials/page_status.html', {'page': page})

    return redirect('page_detail', pk=pk)


@login_required
@require_POST
def approve_page(request, pk):
    """Approve a page (client action)."""
    user = request.user
    page = get_object_or_404(Page.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, page.project):
        raise Http404()

    page.approve()

    # Notify designer
    notify_page_approved_by_client(page, user)

    messages.success(request, f'"{page.title}" approved!')

    if request.htmx:
        return render(request, 'portal/partials/page_status.html', {'page': page})

    return redirect('page_detail', pk=pk)


@login_required
@require_POST
def request_changes(request, pk):
    """Request changes to a page (client action)."""
    user = request.user
    page = get_object_or_404(Page.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, page.project):
        raise Http404()

    reason = request.POST.get('reason', '')
    page.request_changes(reason)

    messages.success(request, f'Changes requested for "{page.title}".')

    if request.htmx:
        return render(request, 'portal/partials/page_status.html', {'page': page})

    return redirect('page_detail', pk=pk)


@login_required
@require_POST
def delete_page(request, pk):
    """Delete a page (designer action)."""
    user = request.user
    page = get_object_or_404(Page.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, page.project) or user.is_client:
        raise Http404()

    project_pk = page.project.pk
    page.delete()

    messages.success(request, 'Page deleted.')

    if request.htmx:
        return HttpResponse('')

    return redirect('sitemap', pk=project_pk)
