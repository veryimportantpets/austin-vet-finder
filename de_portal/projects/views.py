from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import HttpResponse, Http404
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.db.models import Q, Count, Case, When, Value, IntegerField

from orgs.middleware import get_user_projects, user_can_access_project
from .models import Project, ProjectTemplate
from cards.models import Card, CardSubmission, Attachment
from pages.models import Page, PageType
from messaging.models import Thread, Message
from schedule.models import ScheduleItem
from change_requests.models import ChangeRequest


@login_required
def home(request):
    """Client home page with progress and next steps."""
    user = request.user

    if user.is_internal:
        return redirect('dashboard')

    # Get client's active project
    projects = get_user_projects(user).filter(status='active')
    project = projects.first()

    if not project:
        return render(request, 'portal/no_project.html')

    context = {
        'project': project,
        'progress_percent': project.progress_percent,
        'next_step': project.get_next_step_card(),
        'due_soon': project.get_due_soon_cards(),
        'estimated_launch': project.estimated_launch_date,
        'recent_activity': get_recent_activity(project, limit=5),
    }
    return render(request, 'portal/client_home.html', context)


@login_required
def dashboard(request):
    """Designer/Admin dashboard with inbox and schedule."""
    user = request.user

    if user.is_client:
        return redirect('home')

    # Get threads needing DE response
    needs_response = Thread.objects.filter(
        triage_state='needs_de',
        project__status='active'
    ).select_related('project', 'card')

    if user.is_designer and not user.is_admin:
        needs_response = needs_response.filter(project__assigned_designer=user)

    # Get submitted cards needing review
    submitted_cards = Card.objects.filter(
        status='submitted',
        project__status='active'
    ).select_related('project', 'page')

    if user.is_designer and not user.is_admin:
        submitted_cards = submitted_cards.filter(project__assigned_designer=user)

    # Get overdue client cards
    today = timezone.now().date()
    overdue_cards = Card.objects.filter(
        visibility='client',
        status__in=['todo', 'needs_info'],
        due_date__lt=today,
        project__status='active'
    ).select_related('project')

    if user.is_designer and not user.is_admin:
        overdue_cards = overdue_cards.filter(project__assigned_designer=user)

    # Today's schedule
    schedule_today = ScheduleItem.objects.filter(
        date=today,
        status='planned'
    ).select_related('project', 'page')

    if user.is_designer and not user.is_admin:
        schedule_today = schedule_today.filter(assigned_designer=user)

    context = {
        'needs_response': needs_response[:10],
        'submitted_cards': submitted_cards[:10],
        'overdue_cards': overdue_cards[:10],
        'schedule_today': schedule_today[:10],
    }
    return render(request, 'portal/dashboard.html', context)


@login_required
def inbox(request):
    """Internal inbox with all threads needing response."""
    user = request.user

    if user.is_client:
        return redirect('messages')

    threads = Thread.objects.filter(
        project__status='active'
    ).select_related('project', 'card').order_by(
        Case(
            When(triage_state='needs_de', then=Value(0)),
            When(triage_state='waiting_client', then=Value(1)),
            default=Value(2),
            output_field=IntegerField()
        ),
        '-last_message_at'
    )

    if user.is_designer and not user.is_admin:
        threads = threads.filter(project__assigned_designer=user)

    return render(request, 'portal/inbox.html', {'threads': threads[:50]})


@login_required
def project_list(request):
    """List of projects (for designers/admins)."""
    user = request.user

    if user.is_client:
        return redirect('home')

    projects = get_user_projects(user)

    # Filters
    status_filter = request.GET.get('status', '')
    phase_filter = request.GET.get('phase', '')

    if status_filter:
        projects = projects.filter(status=status_filter)
    if phase_filter:
        projects = projects.filter(phase=phase_filter)

    return render(request, 'portal/project_list.html', {
        'projects': projects,
        'status_filter': status_filter,
        'phase_filter': phase_filter,
    })


@login_required
def project_detail(request, pk):
    """Project overview for designers."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project):
        raise Http404()

    cards = project.cards.all()
    pages = project.pages.all()

    context = {
        'project': project,
        'cards': cards,
        'pages': pages,
        'progress_percent': project.progress_percent,
    }
    return render(request, 'portal/project_detail.html', context)


@login_required
def sitemap_view(request, pk):
    """Sitemap editor for designers."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project):
        raise Http404()

    if user.is_client:
        raise Http404()

    page_types = PageType.objects.filter(is_active=True)
    pages = project.pages.select_related('page_type').all()

    return render(request, 'portal/sitemap.html', {
        'project': project,
        'pages': pages,
        'page_types': page_types,
    })


@login_required
@require_POST
def add_page(request, pk):
    """Add a page to the project sitemap."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project) or user.is_client:
        raise Http404()

    title = request.POST.get('title', '').strip()
    page_type_id = request.POST.get('page_type')
    content_source = request.POST.get('content_source', 'client_provides')

    if title:
        page_type = None
        if page_type_id:
            page_type = PageType.objects.filter(pk=page_type_id).first()

        page = Page.objects.create(
            project=project,
            title=title,
            page_type=page_type,
            content_source=content_source,
            sort_order=project.pages.count()
        )

        # Create content collection cards based on source
        create_content_cards_for_page(page, project)

    if request.htmx:
        pages = project.pages.select_related('page_type').all()
        return render(request, 'portal/partials/page_list.html', {'pages': pages, 'project': project})

    return redirect('sitemap', pk=pk)


@login_required
@require_POST
def approve_sitemap(request, pk):
    """Approve the sitemap and generate schedule."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project):
        raise Http404()

    project.sitemap_approved = True
    project.sitemap_approved_at = timezone.now()
    project.save(update_fields=['sitemap_approved', 'sitemap_approved_at', 'updated_at'])

    # Generate schedule
    ScheduleItem.generate_schedule_for_project(project)

    messages.success(request, 'Sitemap approved! Schedule has been generated.')
    return redirect('project_detail', pk=pk)


@login_required
def schedule_view(request, pk):
    """View project schedule."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project):
        raise Http404()

    items = project.schedule_items.select_related('page').all()

    return render(request, 'portal/schedule.html', {
        'project': project,
        'items': items,
    })


@login_required
@require_POST
def change_phase(request, pk):
    """Change project phase."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project) or user.is_client:
        raise Http404()

    new_phase = request.POST.get('phase')
    if new_phase in dict(Project.PHASE_CHOICES):
        project.phase = new_phase
        project.save(update_fields=['phase', 'updated_at'])
        messages.success(request, f'Phase changed to {project.get_phase_display()}')

    return redirect('project_detail', pk=pk)


@login_required
@require_POST
def pause_project(request, pk):
    """Pause a project."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project) or user.is_client:
        raise Http404()

    project.pause()
    messages.success(request, 'Project paused.')
    return redirect('project_detail', pk=pk)


@login_required
@require_POST
def resume_project(request, pk):
    """Resume a paused project."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project) or user.is_client:
        raise Http404()

    project.resume()
    messages.success(request, 'Project resumed.')
    return redirect('project_detail', pk=pk)


@login_required
def project_settings(request, pk):
    """Project settings view."""
    user = request.user
    project = get_object_or_404(Project, pk=pk)

    if not user_can_access_project(user, project) or user.is_client:
        raise Http404()

    if request.method == 'POST':
        project.estimated_launch_date = request.POST.get('estimated_launch_date') or None
        project.save(update_fields=['estimated_launch_date', 'updated_at'])
        messages.success(request, 'Settings updated.')
        return redirect('project_settings', pk=pk)

    return render(request, 'portal/project_settings.html', {'project': project})


def get_recent_activity(project, limit=10):
    """Get recent activity for a project."""
    activity = []

    # Recent messages
    for msg in Message.objects.filter(thread__project=project).order_by('-created_at')[:limit]:
        activity.append({
            'type': 'message',
            'title': f'{msg.sender.get_short_name() if msg.sender else "Someone"} sent a message',
            'timestamp': msg.created_at,
            'link': '/messages/'
        })

    # Recent submissions
    for sub in CardSubmission.objects.filter(card__project=project).order_by('-created_at')[:limit]:
        activity.append({
            'type': 'submission',
            'title': f'Submitted: {sub.card.title}',
            'timestamp': sub.created_at,
            'link': f'/card/{sub.card.id}/'
        })

    # Sort by timestamp
    activity.sort(key=lambda x: x['timestamp'], reverse=True)
    return activity[:limit]


def create_content_cards_for_page(page, project):
    """Create content collection cards for a page based on content source."""
    if page.content_source == 'client_provides':
        Card.objects.create(
            project=project,
            page=page,
            visibility='client',
            kind='client_task',
            title=f'Provide copy for {page.title}',
            why_it_matters='Your content makes your website unique and helps clients understand your practice.',
            instructions=f'Please provide the text content for your {page.title} page.',
            best_practices=page.page_type.best_practices if page.page_type else '',
            required=True,
            phase='creative'
        )
        Card.objects.create(
            project=project,
            page=page,
            visibility='client',
            kind='client_task',
            title=f'Upload images for {page.title}',
            why_it_matters='Quality images make your website more engaging.',
            instructions=f'Upload photos to use on your {page.title} page.',
            required=False,
            phase='creative'
        )
    elif page.content_source == 'existing_site':
        Card.objects.create(
            project=project,
            page=page,
            visibility='client',
            kind='client_task',
            title=f'Confirm reuse of copy for {page.title}',
            why_it_matters='We want to make sure you\'re happy with the existing content.',
            instructions=f'Please confirm we can reuse the content from your current {page.title} page.',
            required=True,
            phase='creative'
        )
    elif page.content_source == 'de_writes':
        Card.objects.create(
            project=project,
            page=page,
            visibility='internal',
            kind='internal_task',
            title=f'Write draft for {page.title}',
            instructions=f'Write the initial content draft for the {page.title} page.',
            required=True,
            phase='creative',
            assigned_to_role='designer'
        )
        Card.objects.create(
            project=project,
            page=page,
            visibility='client',
            kind='client_task',
            title=f'Approve draft copy for {page.title}',
            why_it_matters='We want to make sure the content matches your vision.',
            instructions=f'Please review and approve the draft content for your {page.title} page.',
            required=True,
            phase='creative'
        )
