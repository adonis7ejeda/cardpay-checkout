# Delivery Verification Specification

## Purpose

Defines documentation, test evidence, build delivery, and chained review expectations for the checkout slice.

## Requirements

### Requirement: Test and Coverage Evidence

Delivery MUST include commands and evidence showing mobile and backend Jest coverage exceed 80%.

#### Scenario: Coverage is documented
- GIVEN verification is complete
- WHEN reviewers read delivery documentation
- THEN mobile and backend coverage commands and results are visible

### Requirement: Build and Run Documentation

README documentation MUST explain setup, run, test, backend execution, and Android APK generation without exposing secrets.

#### Scenario: New reviewer follows README
- GIVEN a clean checkout of the repository
- WHEN a reviewer follows documented commands
- THEN they can run tests and identify the APK generation path

### Requirement: Chained Review Delivery

Implementation delivery MUST use forced chained PR slices within the 800 changed-line review budget unless an explicit size exception is approved.

#### Scenario: PR slice is reviewable
- GIVEN a delivery slice is prepared
- WHEN the PR is opened
- THEN it states scope, dependency, verification, rollback, and changed-line budget

### Requirement: Secret and Branding Hygiene

Delivery artifacts MUST NOT persist raw secrets or sponsor-branded names in repository paths, packages, code, docs, or UI copy.

#### Scenario: Artifact hygiene check passes
- GIVEN specs, docs, code, and package metadata are reviewed
- WHEN searching for raw credentials or sponsor-branded names
- THEN none are present
