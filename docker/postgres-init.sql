-- Runs once, when the Postgres volume is first created.
-- tudu holds your tasks; tudu_test is wiped by the test runs.
CREATE DATABASE tudu_test OWNER tudu;
