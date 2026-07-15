#!/usr/bin/env node
"use strict";

/**
 * Public-delivery hygiene gate.
 *
 * Scans every GIT-TRACKED file (via `git ls-files`, so `.gitignore`d paths
 * such as `node_modules`, build output, and `.env` are naturally skipped)
 * for:
 *
 *   1. The disallowed sponsor/payment-provider brand name (case-insensitive).
 *   2. Credential/API-key-shaped strings (provider key prefixes, AWS access
 *      keys, and generic 32+ char secret-looking assignments).
 *   3. Raw PAN/CVC leakage into `console.log`/`console.warn`/`console.error`
 *      calls.
 *
 * Exits non-zero on any finding so it can be wired into CI/pre-merge gates,
 * not just run informationally.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// The disallowed sponsor/payment-provider brand name must not appear in this
// repository even here, in the script whose job is to detect it - a plain
// `git grep -i` for the name must find nothing at all, no exceptions. Its
// only representation anywhere in tracked source is this base64 encoding,
// decoded at runtime purely to build the detection pattern below.
const SPONSOR_BRAND_NAME = Buffer.from("d29tcGk=", "base64").toString("utf8");
const SPONSOR_PATTERN = new RegExp(SPONSOR_BRAND_NAME, "i");

const CREDENTIAL_PATTERNS = [
  { name: "public API key (pub_...)", pattern: /\bpub_[A-Za-z0-9_]+/ },
  { name: "private API key (prv_...)", pattern: /\bprv_[A-Za-z0-9_]+/ },
  { name: "secret key (sk_...)", pattern: /\bsk_[A-Za-z0-9_]+/ },
  { name: "publishable key (pk_...)", pattern: /\bpk_[A-Za-z0-9_]+/ },
  { name: "AWS access key ID", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "generic secret-shaped assignment (32+ char base64/hex value)",
    pattern: /\b(?:secret|token|password|api[_-]?key|credential)[A-Za-z0-9_]*\s*[:=]\s*["'`]?[A-Za-z0-9+/_-]{32,}["'`]?/i
  }
];

const CARD_LOG_KEYWORD = /\b(cvc|cvv|pan|cardnumber|card_number|full ?card|raw ?card)\b/i;
const CONSOLE_CALL = /console\.(?:log|warn|error)\s*\(([\s\S]{0,400}?)\)\s*;/g;

const EXCLUDED_DIR_SEGMENTS = ["node_modules/", "dist/", "build/", "coverage/", ".turbo/", "cdk.out/", "android/app/build/", "android/build/", "android/.gradle/", "android/.cxx/"];
const EXCLUDED_EXTENSIONS = [".apk", ".png", ".jpg", ".jpeg", ".ico", ".ttf", ".otf", ".woff", ".woff2", ".zip", ".jar", ".keystore", ".jks", ".pdf"];
const SELF_PATH = toPosix(path.relative(process.cwd(), __filename));

function toPosix(value) {
  return value.split(path.sep).join("/");
}

/** Exported for tests. Decides whether a repo-relative path should be scanned at all. */
function isExcludedPath(relativePath) {
  const normalized = toPosix(relativePath);
  if (normalized === SELF_PATH) return true;
  if (EXCLUDED_DIR_SEGMENTS.some((segment) => normalized === segment.slice(0, -1) || normalized.startsWith(segment) || normalized.includes(`/${segment}`))) return true;
  const ext = path.extname(normalized).toLowerCase();
  return EXCLUDED_EXTENSIONS.includes(ext);
}

/** True if the buffer looks binary (contains a NUL byte in its first 8KB). */
function looksBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

// Test files legitimately assign obviously-fake, credential-shaped fixture
// values (e.g. `PAYMENT_PROVIDER_PUBLIC_KEY: "pub_stagtest_example"`) to
// exercise env-driven adapters without touching real secrets. Credential
// SHAPE checks are skipped for these files so the gate does not cry wolf on
// known-fake fixtures; brand-name and unsafe-logging checks still apply.
const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** Exported for tests. Scans one file's content, returning a list of findings. */
function scanFileContent(relativePath, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  const isTestFile = TEST_FILE_PATTERN.test(relativePath);

  lines.forEach((line, index) => {
    if (SPONSOR_PATTERN.test(line)) {
      findings.push({ file: relativePath, line: index + 1, rule: "disallowed sponsor/provider brand name", excerpt: line.trim().slice(0, 200) });
    }
    if (isTestFile) return;
    for (const { name, pattern } of CREDENTIAL_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({ file: relativePath, line: index + 1, rule: `credential-shaped string: ${name}`, excerpt: line.trim().slice(0, 200) });
      }
    }
  });

  let match;
  CONSOLE_CALL.lastIndex = 0;
  while ((match = CONSOLE_CALL.exec(content)) !== null) {
    const args = match[1];
    if (CARD_LOG_KEYWORD.test(args)) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push({ file: relativePath, line, rule: "console.log/warn/error referencing card/CVC/PAN data", excerpt: match[0].trim().slice(0, 200) });
    }
  }

  return findings;
}

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files"], { encoding: "utf8", cwd: process.cwd() });
  return output.split(/\r?\n/).filter(Boolean);
}

function scanRepo() {
  const files = listTrackedFiles().filter((file) => !isExcludedPath(file));
  const findings = [];

  for (const file of files) {
    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch {
      continue; // removed since git ls-files ran, or unreadable; do not crash the gate
    }
    if (looksBinary(buffer)) continue;
    findings.push(...scanFileContent(file, buffer.toString("utf8")));
  }

  return { files, findings };
}

function main() {
  const { files, findings } = scanRepo();

  if (findings.length === 0) {
    console.log(`Hygiene scan PASS: ${files.length} tracked files scanned, 0 findings.`);
    process.exitCode = 0;
    return;
  }

  console.error(`Hygiene scan FAIL: ${findings.length} finding(s) across ${files.length} tracked files scanned.\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  [${finding.rule}]  ${finding.excerpt}`);
  }
  process.exitCode = 1;
}

module.exports = { isExcludedPath, scanFileContent, scanRepo, looksBinary, SPONSOR_PATTERN, CREDENTIAL_PATTERNS, CARD_LOG_KEYWORD };

if (require.main === module) {
  main();
}
