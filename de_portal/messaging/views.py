from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages as django_messages
from django.http import HttpResponse, Http404
from django.views.decorators.http import require_POST

from orgs.middleware import get_user_projects, user_can_access_project
from .models import Thread, Message
from notifications.services import notify_new_message


@login_required
def messages_view(request):
    """Client's project chat."""
    user = request.user
    projects = get_user_projects(user).filter(status='active')
    project = projects.first()

    if not project:
        return render(request, 'portal/no_project.html')

    # Get or create project chat thread
    thread = Thread.get_or_create_project_chat(project)
    thread_messages = thread.messages.select_related('sender').all()

    return render(request, 'portal/messages.html', {
        'project': project,
        'thread': thread,
        'messages': thread_messages,
    })


@login_required
@require_POST
def post_message(request, pk):
    """Post a message to a thread."""
    user = request.user
    thread = get_object_or_404(Thread.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, thread.project):
        raise Http404()

    body = request.POST.get('body', '').strip()
    if body:
        message = thread.add_message(sender=user, body=body)

        # Notify
        notify_new_message(thread, message)

    if request.htmx:
        thread_messages = thread.messages.select_related('sender').all()
        return render(request, 'portal/partials/message_list.html', {
            'messages': thread_messages,
            'thread': thread,
        })

    # Redirect based on thread type
    if thread.card:
        return redirect('card_detail', pk=thread.card.pk)
    return redirect('messages')


@login_required
def thread_detail(request, pk):
    """View a specific thread (for internal users)."""
    user = request.user
    thread = get_object_or_404(Thread.objects.select_related('project', 'card'), pk=pk)

    if not user_can_access_project(user, thread.project):
        raise Http404()

    thread_messages = thread.messages.select_related('sender').all()

    return render(request, 'portal/thread_detail.html', {
        'thread': thread,
        'project': thread.project,
        'messages': thread_messages,
    })


@login_required
@require_POST
def mark_resolved(request, pk):
    """Mark a thread as resolved."""
    user = request.user
    thread = get_object_or_404(Thread.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, thread.project) or user.is_client:
        raise Http404()

    thread.mark_resolved()

    if request.htmx:
        return HttpResponse('<span class="badge bg-success">Resolved</span>')

    return redirect('thread_detail', pk=pk)


@login_required
@require_POST
def set_triage_state(request, pk):
    """Set the triage state of a thread."""
    user = request.user
    thread = get_object_or_404(Thread.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, thread.project) or user.is_client:
        raise Http404()

    new_state = request.POST.get('state')
    if new_state in dict(Thread.TRIAGE_STATE_CHOICES):
        thread.triage_state = new_state
        thread.save(update_fields=['triage_state', 'updated_at'])

    if request.htmx:
        return render(request, 'portal/partials/triage_badge.html', {'thread': thread})

    return redirect('thread_detail', pk=pk)
