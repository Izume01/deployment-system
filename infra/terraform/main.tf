# enabling all the services

resource "google_project_service" "apis"{
  for_each = toset([
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com"
  ])
  service = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "source" {
  name          = "${var.project_id}-source-bucket"
  location      = "${var.region}"
  force_destroy = true
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_artifact_registry_repository" "apps" {
  location = var.region
  format   = "DOCKER"
  repository_id = "${var.project_id}-apps"
  description = "Repository for application container images"

  depends_on = [google_project_service.apis]
}

resource "google_service_account" "pass_engine" {
  account_id = "paas-engine"
  display_name = "PAAS Engine Service Account"

  depends_on = [ google_project_service.apis ]
}

resource "google_project_iam_member" "roles" {
  for_each = toset([
    "roles/cloudbuild.builds.editor",
    "roles/run.admin",
    "roles/storage.objectAdmin",
    "roles/iam.serviceAccountUser"
  ])
  project = var.project_id
  role   = each.value
  member = "serviceAccount:${google_service_account.pass_engine.email}"

  depends_on = [google_project_service.apis, google_service_account.pass_engine]
}