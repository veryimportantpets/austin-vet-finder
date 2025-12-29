from django.contrib import admin
from .models import ProjectTemplate, Project, Credential


@admin.register(ProjectTemplate)
class ProjectTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'org', 'phase', 'status', 'assigned_designer', 'created_at']
    list_filter = ['phase', 'status', 'template']
    search_fields = ['name', 'org__name']
    raw_id_fields = ['org', 'assigned_designer', 'template']
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {'fields': ('name', 'org', 'template')}),
        ('Status', {'fields': ('phase', 'status', 'assigned_designer')}),
        ('Dates', {'fields': ('estimated_launch_date', 'actual_launch_date', 'sitemap_approved', 'sitemap_approved_at')}),
        ('Drive', {'fields': ('drive_folder_id',)}),
    )


@admin.register(Credential)
class CredentialAdmin(admin.ModelAdmin):
    list_display = ['label', 'credential_type', 'project', 'created_at']
    list_filter = ['credential_type']
    search_fields = ['label', 'project__name']
    raw_id_fields = ['project', 'created_by']
