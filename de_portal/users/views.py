from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.mail import send_mail
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.http import require_POST, require_GET

from .models import User, MagicLink


def login_view(request):
    """Display login form and handle magic link request."""
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        email = request.POST.get('email', '').strip().lower()
        if email:
            try:
                user = User.objects.get(email=email)
                magic_link = MagicLink.create_for_user(
                    user,
                    expiry_minutes=settings.MAGIC_LINK_EXPIRY_MINUTES
                )

                # Build magic link URL
                link_url = request.build_absolute_uri(f'/auth/magic/{magic_link.token}/')

                # Send email
                send_mail(
                    subject='Your login link for DE Portal',
                    message=f'Click here to log in: {link_url}\n\nThis link expires in {settings.MAGIC_LINK_EXPIRY_MINUTES} minutes.',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False,
                )

                messages.success(request, 'Check your email for a login link!')
                return render(request, 'users/check_email.html', {'email': email})

            except User.DoesNotExist:
                messages.error(request, 'No account found with that email address.')

    return render(request, 'users/login.html')


def magic_link_view(request, token):
    """Handle magic link login."""
    try:
        magic_link = MagicLink.objects.select_related('user').get(token=token)

        if magic_link.is_valid():
            magic_link.mark_used()
            login(request, magic_link.user)
            messages.success(request, f'Welcome back, {magic_link.user.get_short_name()}!')
            return redirect('home')
        else:
            messages.error(request, 'This login link has expired or already been used.')

    except MagicLink.DoesNotExist:
        messages.error(request, 'Invalid login link.')

    return redirect('login')


def logout_view(request):
    """Log out the user."""
    logout(request)
    messages.info(request, 'You have been logged out.')
    return redirect('login')


@login_required
def profile_view(request):
    """View and edit user profile."""
    if request.method == 'POST':
        request.user.first_name = request.POST.get('first_name', '')
        request.user.last_name = request.POST.get('last_name', '')
        request.user.save(update_fields=['first_name', 'last_name'])
        messages.success(request, 'Profile updated.')
        return redirect('profile')

    return render(request, 'users/profile.html')


@login_required
def notifications_list(request):
    """List user's notifications."""
    notifications = request.user.notifications.all()[:50]
    return render(request, 'users/notifications.html', {'notifications': notifications})


@login_required
@require_POST
def mark_notification_read(request, pk):
    """Mark a notification as read."""
    notification = request.user.notifications.filter(pk=pk).first()
    if notification:
        notification.mark_read()
    if request.htmx:
        return HttpResponse('')
    return redirect('notifications')


@login_required
@require_POST
def mark_all_notifications_read(request):
    """Mark all notifications as read."""
    request.user.notifications.filter(is_read=False).update(is_read=True)
    if request.htmx:
        return HttpResponse('<span class="badge bg-secondary">0</span>')
    return redirect('notifications')
