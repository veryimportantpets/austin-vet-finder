from django.contrib import admin
from .models import PageType, Page


@admin.register(PageType)
class PageTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}
    ordering = ['sort_order', 'name']


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'page_type', 'content_source', 'status', 'sort_order']
    list_filter = ['status', 'content_source', 'page_type']
    search_fields = ['title', 'project__name']
    raw_id_fields = ['project', 'page_type']
    ordering = ['project', 'sort_order']
