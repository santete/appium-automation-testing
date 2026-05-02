// InfluxDB 2 init — verify bucket created (entrypoint dùng env vars để setup
// admin user + bucket; file này chỉ chạy verification query).
//
// M5 Task 5 — bucket "test-runs" được tạo automatic bởi DOCKER_INFLUXDB_INIT_*
// env vars trong docker-compose.yaml. File này dùng làm marker + sample query
// reference cho dev (Grafana panels build trên cùng schema).
//
// Schema (data points):
//   measurement: test_run
//   tags: { test_id, suite, env, device, branch }
//   fields: { duration_ms, status (0|1), category (string label) }
//
//   measurement: pipeline_duration
//   tags: { workflow, branch }
//   fields: { duration_seconds }
//
//   measurement: flaky_verdict
//   tags: { test_id }
//   fields: { pass_rate, recent_fail_count, should_quarantine (0|1) }

// Verification query — pass rate 7-day rolling.
from(bucket: "test-runs")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "test_run")
  |> filter(fn: (r) => r._field == "status")
  |> mean()
  |> yield(name: "pass_rate_7d")
