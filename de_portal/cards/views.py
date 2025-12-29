from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import HttpResponse, Http404
from django.views.decorators.http import require_POST

from orgs.middleware import get_user_projects, user_can_access_project
from .models import Card, CardSubmission, Attachment
from messaging.models import Thread
from integrations.storage import get_storage_adapter
from notifications.services import notify_card_submission, notify_needs_more_info


@login_required
def tasks_list(request):
    """Client's task list."""
    user = request.user
    projects = get_user_projects(user).filter(status='active')
    project = projects.first()

    if not project:
        return render(request, 'portal/no_project.html')

    cards = Card.objects.filter(
        project=project,
        visibility='client'
    ).order_by('status', 'due_date', 'sort_order')

    return render(request, 'portal/tasks_list.html', {
        'project': project,
        'cards': cards,
    })


@login_required
def card_detail(request, pk):
    """Card detail with submission form and thread."""
    user = request.user
    card = get_object_or_404(Card.objects.select_related('project', 'page'), pk=pk)

    if not user_can_access_project(user, card.project):
        raise Http404()

    # Get or create thread for this card
    thread = Thread.get_or_create_card_thread(card)
    thread_messages = thread.messages.select_related('sender').all()

    # Get latest submission
    latest_submission = card.latest_submission
    attachments = []
    if latest_submission:
        attachments = latest_submission.attachments.all()

    context = {
        'card': card,
        'project': card.project,
        'thread': thread,
        'messages': thread_messages,
        'latest_submission': latest_submission,
        'attachments': attachments,
    }
    return render(request, 'portal/card_detail.html', context)


@login_required
@require_POST
def submit_card(request, pk):
    """Submit a card with text and/or file uploads."""
    user = request.user
    card = get_object_or_404(Card.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, card.project):
        raise Http404()

    text_content = request.POST.get('text_content', '')
    files = request.FILES.getlist('files')

    # Create submission
    submission = card.submit(text_content=text_content, submitted_by=user)

    # Handle file uploads
    if files:
        storage = get_storage_adapter()
        for f in files:
            file_ref = storage.save_file(
                project_id=card.project.id,
                filename=f.name,
                file_data=f,
                mime_type=f.content_type,
                subfolder=f'card_{card.id}'
            )
            Attachment.objects.create(
                submission=submission,
                filename=file_ref.filename,
                file_path=file_ref.id,
                file_url=file_ref.url,
                file_size=file_ref.size,
                mime_type=file_ref.mime_type,
                storage_backend=file_ref.meta.get('storage', 'local'),
                storage_ref=file_ref.meta,
                uploaded_by=user
            )

    # Notify
    notify_card_submission(card, submission)

    messages.success(request, 'Submitted successfully!')

    if request.htmx:
        return render(request, 'portal/partials/card_status.html', {'card': card})

    return redirect('card_detail', pk=pk)


@login_required
@require_POST
def accept_card(request, pk):
    """Accept a card submission (designer action)."""
    user = request.user
    card = get_object_or_404(Card.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, card.project) or user.is_client:
        raise Http404()

    card.accept()
    messages.success(request, f'Card "{card.title}" accepted.')

    if request.htmx:
        return render(request, 'portal/partials/card_status.html', {'card': card})

    return redirect('card_detail', pk=pk)


@login_required
@require_POST
def needs_info_card(request, pk):
    """Request more info on a card (designer action)."""
    user = request.user
    card = get_object_or_404(Card.objects.select_related('project'), pk=pk)

    if not user_can_access_project(user, card.project) or user.is_client:
        raise Http404()

    card.request_more_info()

    # Notify client
    notify_needs_more_info(card)

    messages.success(request, f'Requested more info on "{card.title}".')

    if request.htmx:
        return render(request, 'portal/partials/card_status.html', {'card': card})

    return redirect('card_detail', pk=pk)


@login_required
def internal_cards_list(request, pk):
    """Internal cards for a project (designer view)."""
    user = request.user

    if user.is_client:
        raise Http404()

    from projects.models import Project
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project):
        raise Http404()

    cards = Card.objects.filter(
        project=project,
        visibility='internal'
    ).order_by('status', 'due_date', 'sort_order')

    return render(request, 'portal/internal_cards.html', {
        'project': project,
        'cards': cards,
    })
