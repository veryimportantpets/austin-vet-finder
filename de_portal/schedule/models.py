from django.db import models
from django.conf import settings


class ScheduleItem(models.Model):
    """A scheduled work item for a designer."""
    STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('done', 'Done'),
        ('blocked', 'Blocked'),
    ]

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='schedule_items'
    )
    assigned_designer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schedule_items'
    )
    page = models.ForeignKey(
        'pages.Page',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schedule_items'
    )
    date = models.DateField()
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    block_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'title']

    def __str__(self):
        return f"{self.date}: {self.title}"

    def mark_done(self):
        self.status = 'done'
        self.save(update_fields=['status', 'updated_at'])

    def mark_blocked(self, reason=''):
        self.status = 'blocked'
        self.block_reason = reason
        self.save(update_fields=['status', 'block_reason', 'updated_at'])

    def check_if_blocked(self):
        """Check if this item should be blocked due to missing client assets."""
        if not self.page:
            return False

        from cards.models import Card

        # Check if any required client cards for this page are not accepted
        pending_cards = Card.objects.filter(
            project=self.project,
            page=self.page,
            visibility='client',
            required=True
        ).exclude(status='accepted')

        if pending_cards.exists():
            card_titles = ', '.join(pending_cards.values_list('title', flat=True)[:3])
            self.mark_blocked(f"Waiting on: {card_titles}")
            return True

        if self.status == 'blocked':
            self.status = 'planned'
            self.block_reason = ''
            self.save(update_fields=['status', 'block_reason', 'updated_at'])

        return False

    @classmethod
    def generate_schedule_for_project(cls, project):
        """Generate initial schedule after sitemap approval."""
        from datetime import timedelta
        from django.utils import timezone

        if not project.sitemap_approved:
            return []

        pages = project.pages.all().order_by('sort_order')
        if not pages.exists():
            return []

        # Start from today or a week from now
        start_date = timezone.now().date() + timedelta(days=7)
        created_items = []

        # Schedule homepage first
        homepage = pages.filter(page_type__slug='home').first() or pages.first()
        if homepage:
            item = cls.objects.create(
                project=project,
                assigned_designer=project.assigned_designer,
                page=homepage,
                date=start_date,
                title=f"Build: {homepage.title}"
            )
            created_items.append(item)
            start_date += timedelta(days=7)

        # Schedule remaining pages (~1 per week)
        for page in pages.exclude(pk=homepage.pk if homepage else None):
            item = cls.objects.create(
                project=project,
                assigned_designer=project.assigned_designer,
                page=page,
                date=start_date,
                title=f"Build: {page.title}"
            )
            created_items.append(item)
            start_date += timedelta(days=7)

        # Set estimated launch date
        if created_items:
            project.estimated_launch_date = start_date + timedelta(days=14)  # 2 weeks after last page
            project.save(update_fields=['estimated_launch_date', 'updated_at'])

        return created_items
