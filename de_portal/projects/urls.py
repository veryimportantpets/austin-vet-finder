from django.urls import path
from . import views

urlpatterns = [
    # Client-facing
    path('', views.home, name='root'),
    path('home/', views.home, name='home'),

    # Designer/Admin
    path('dashboard/', views.dashboard, name='dashboard'),
    path('inbox/', views.inbox, name='inbox'),
    path('projects/', views.project_list, name='project_list'),
    path('project/<int:pk>/', views.project_detail, name='project_detail'),
    path('project/<int:pk>/sitemap/', views.sitemap_view, name='sitemap'),
    path('project/<int:pk>/sitemap/add/', views.add_page, name='add_page'),
    path('project/<int:pk>/sitemap/approve/', views.approve_sitemap, name='approve_sitemap'),
    path('project/<int:pk>/schedule/', views.schedule_view, name='schedule'),
    path('project/<int:pk>/settings/', views.project_settings, name='project_settings'),
    path('project/<int:pk>/phase/', views.change_phase, name='change_phase'),
    path('project/<int:pk>/pause/', views.pause_project, name='pause_project'),
    path('project/<int:pk>/resume/', views.resume_project, name='resume_project'),
]
