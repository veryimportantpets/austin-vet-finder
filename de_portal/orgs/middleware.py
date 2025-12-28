"""
Tenant middleware for multi-tenant access control.
"""
from django.shortcuts import redirect
from django.urls import reverse


class TenantMiddleware:
    """
    Middleware to set the current organization context for the request.
    Clients can only access their own organization's projects.
    Designers/Admins can access their assigned projects.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip for unauthenticated users or static/admin paths
        if not request.user.is_authenticated:
            return self.get_response(request)

        path = request.path
        if path.startswith('/admin/') or path.startswith('/static/') or path.startswith('/media/'):
            return self.get_response(request)

        # Set org context for clients
        if request.user.is_client:
            membership = request.user.memberships.select_related('org').first()
            if membership:
                request.current_org = membership.org
            else:
                request.current_org = None
        else:
            request.current_org = None

        return self.get_response(request)


def get_user_projects(user):
    """Get projects accessible by a user."""
    from projects.models import Project

    if user.is_admin:
        return Project.objects.all()

    if user.is_designer:
        return Project.objects.filter(assigned_designer=user)

    if user.is_client:
        org_ids = user.memberships.values_list('org_id', flat=True)
        return Project.objects.filter(org_id__in=org_ids)

    return Project.objects.none()


def user_can_access_project(user, project):
    """Check if a user can access a specific project."""
    if user.is_admin:
        return True

    if user.is_designer:
        return project.assigned_designer_id == user.id

    if user.is_client:
        return user.memberships.filter(org=project.org).exists()

    return False
