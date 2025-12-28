from django.db import models
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet
import json


class ProjectTemplate(models.Model):
    """Template for creating new projects with predefined phases and cards."""
    TEMPLATE_CHOICES = [
        ('startup', 'New Practice (Startup)'),
        ('existing', 'Existing Practice'),
    ]

    slug = models.SlugField(unique=True, max_length=50)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    phase_order = models.JSONField(default=list)  # ['discovery', 'creative', 'launch']
    discovery_cards = models.JSONField(default=list)
    creative_cards = models.JSONField(default=list)
    launch_cards = models.JSONField(default=list)
    page_type_card_packs = models.JSONField(default=dict)  # page_type -> [card templates]
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Project(models.Model):
    """A website build project for a client organization."""
    PHASE_CHOICES = [
        ('discovery', 'Discovery'),
        ('creative', 'Creative'),
        ('launch', 'Launch'),
        ('complete', 'Complete'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('complete', 'Complete'),
        ('archived', 'Archived'),
    ]

    org = models.ForeignKey(
        'orgs.ClientOrg',
        on_delete=models.CASCADE,
        related_name='projects'
    )
    name = models.CharField(max_length=200)
    template = models.ForeignKey(
        ProjectTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects'
    )
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES, default='discovery')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    assigned_designer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_projects',
        limit_choices_to={'role__in': ['designer', 'admin']}
    )
    estimated_launch_date = models.DateField(null=True, blank=True)
    actual_launch_date = models.DateField(null=True, blank=True)
    sitemap_approved = models.BooleanField(default=False)
    sitemap_approved_at = models.DateTimeField(null=True, blank=True)
    drive_folder_id = models.CharField(max_length=200, blank=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.org.name})"

    def pause(self):
        self.status = 'paused'
        self.paused_at = timezone.now()
        self.save(update_fields=['status', 'paused_at', 'updated_at'])

    def resume(self):
        self.status = 'active'
        self.paused_at = None
        self.save(update_fields=['status', 'paused_at', 'updated_at'])

    def complete(self):
        self.status = 'complete'
        self.phase = 'complete'
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'phase', 'completed_at', 'updated_at'])

    def archive(self):
        self.status = 'archived'
        self.archived_at = timezone.now()
        self.save(update_fields=['status', 'archived_at', 'updated_at'])

    @property
    def is_paused(self):
        return self.status == 'paused'

    @property
    def progress_percent(self):
        """Calculate progress based on required client cards accepted."""
        from cards.models import Card
        required_cards = Card.objects.filter(
            project=self,
            visibility='client',
            required=True
        )
        total = required_cards.count()
        if total == 0:
            return 0
        accepted = required_cards.filter(status='accepted').count()
        return int((accepted / total) * 100)

    def get_next_step_card(self):
        """Get the highest priority card for the client to complete."""
        from cards.models import Card
        from django.db.models import Case, When, Value, IntegerField
        from django.utils import timezone

        today = timezone.now().date()

        cards = Card.objects.filter(
            project=self,
            visibility='client',
            status__in=['todo', 'needs_info']
        ).annotate(
            priority=Case(
                When(due_date__lt=today, then=Value(0)),  # Overdue first
                When(due_date__isnull=False, then=Value(1)),  # Has due date
                default=Value(2),
                output_field=IntegerField()
            )
        ).order_by('priority', 'due_date', 'created_at')

        return cards.first()

    def get_due_soon_cards(self, limit=3):
        """Get cards due soon for the client."""
        from cards.models import Card
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.now().date()
        next_week = today + timedelta(days=7)

        return Card.objects.filter(
            project=self,
            visibility='client',
            status__in=['todo', 'needs_info'],
            due_date__range=[today, next_week]
        ).order_by('due_date')[:limit]


class Credential(models.Model):
    """Encrypted storage for sensitive credentials like domain registrar logins."""
    TYPE_CHOICES = [
        ('domain_registrar', 'Domain Registrar'),
        ('email_hosting', 'Email Hosting'),
        ('cms_admin', 'CMS Admin'),
        ('other', 'Other'),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='credentials'
    )
    credential_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    label = models.CharField(max_length=100)
    encrypted_value = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    class Meta:
        ordering = ['credential_type', 'label']

    def __str__(self):
        return f"{self.label} ({self.get_credential_type_display()})"

    def set_value(self, value):
        """Encrypt and store the credential value."""
        key = settings.CREDENTIALS_ENCRYPTION_KEY
        if not key:
            raise ValueError("CREDENTIALS_ENCRYPTION_KEY not configured")
        f = Fernet(key.encode() if isinstance(key, str) else key)
        self.encrypted_value = f.encrypt(value.encode())

    def get_value(self):
        """Decrypt and return the credential value."""
        key = settings.CREDENTIALS_ENCRYPTION_KEY
        if not key:
            raise ValueError("CREDENTIALS_ENCRYPTION_KEY not configured")
        f = Fernet(key.encode() if isinstance(key, str) else key)
        return f.decrypt(self.encrypted_value).decode()
