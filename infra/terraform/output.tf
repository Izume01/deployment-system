output "source_bucket_name" {
  description = "The name of the source storage bucket"
  value       = google_storage_bucket.source.name
}

output "artifact_registry_url" {
  description = "The Docker push/pull URL of the artifact registry"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.apps.repository_id}"
}

output "pass_engine_service_account_email" {
  description = "The email address of the PAAS Engine service account"
  value       = google_service_account.pass_engine.email
}
