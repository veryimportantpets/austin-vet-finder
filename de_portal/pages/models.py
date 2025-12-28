from django.db import models
from django.conf import settings


class PageType(models.Model):
    """Defines types of pages with associated best practices."""
    slug = models.SlugField(unique=True, max_length=50)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    best_practices = models.TextField(blank=True, help_text="Guidance for this page type")
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Page(models.Model):
    """A page in a client's website project."""
    CONTENT_SOURCE_CHOICES = [
        ('existing_site', 'Reuse from existing site'),
        ('client_provides', 'Client provides content'),
        ('de_writes', 'DE writes content'),
    ]

    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_build', 'In Build'),
        ('ready_for_review', 'Ready for Review'),
        ('changes_requested', 'Changes Requested'),
        ('approved', 'Approved'),
        ('locked', 'Locked'),
    ]

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='pages'
    )
    title = models.CharField(max_length=200)
    page_type = models.ForeignKey(
        PageType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pages'
    )
    content_source = models.CharField(
        max_length=20,
        choices=CONTENT_SOURCE_CHOICES,
        default='client_provides'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    preview_url = models.URLField(blank=True, help_text="Staging site preview URL")
    sort_order = models.IntegerField(default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'title']

    def __str__(self):
        return f"{self.title} ({self.project.name})"

    def mark_ready_for_review(self):
        """Mark page as ready for review and create/update review card."""
        from cards.models import Card

        self.status = 'ready_for_review'
        self.save(update_fields=['status', 'updated_at'])

        # Create or update page review card
        review_card, created = Card.objects.get_or_create(
            project=self.project,
            page=self,
            kind='page_review',
            defaults={
                'title': f'Review: {self.title}',
                'why_it_matters': 'Your feedback helps us ensure the page meets your expectations.',
                'instructions': 'Please review this page and either approve it or request changes.',
                'visibility': 'client',
                'status': 'todo',
                'required': True,
            }
        )

        if not created:
            review_card.status = 'todo'
            review_card.save(update_fields=['status', 'updated_at'])

        return review_card

    def approve(self):
        """Mark page as approved."""
        self.status = 'approved'
        self.save(update_fields=['status', 'updated_at'])

        # Mark associated review card as accepted
        from cards.models import Card
        Card.objects.filter(
            project=self.project,
            page=self,
            kind='page_review'
        ).update(status='accepted')

    def request_changes(self, reason=''):
        """Mark page as needing changes."""
        self.status = 'changes_requested'
        if reason:
            self.notes = f"Changes requested: {reason}\n\n{self.notes}"
        self.save(update_fields=['status', 'notes', 'updated_at'])
