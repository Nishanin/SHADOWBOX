const path = require('path');
const fs = require('fs');

/**
 * Static Code Investigator.
 *
 * Inspects repository source files and configuration without executing code.
 * Detects timezone-sensitive Date accessors, process.env references, platform checks,
 * path assumptions, and OS command executions.
 */
class CodeInvestigator {
  /**
   * Performs static code analysis on the repository.
   *
   * @param {object} params
   * @param {string} [params.repoDir] Path to the unpacked repository
   * @param {string[]} [params.repoFiles] Relative file paths
   * @param {string} [params.errorDescription] User-supplied failure description
   * @param {string} [params.ciLog] User-supplied CI log
   * @returns {object} Structured code investigation result
   */
  analyze({ repoDir, repoFiles = [], errorDescription = '', ciLog = '' }) {
    const findings = [];
    const evidence = [];
    const missingEvidence = [];
    let codeInspection = null;
    let scannedFilesCount = 0;
    const flaggedFiles = new Set();

    // Extensions to inspect
    const codeExts = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json']);
    // Directories to skip
    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

    // Identify candidate files to inspect
    let filesToInspect = [];
    if (repoFiles && repoFiles.length > 0) {
      filesToInspect = repoFiles.filter((relPath) => {
        const parts = relPath.split(/[/\\]/);
        if (parts.some((p) => ignoredDirs.includes(p))) return false;
        const ext = path.extname(relPath).toLowerCase();
        return codeExts.has(ext);
      });
    } else if (repoDir && fs.existsSync(repoDir)) {
      filesToInspect = this.collectFiles(repoDir, repoDir, ignoredDirs, codeExts);
    }

    // Pattern definitions
    const patterns = [
      {
        id: 'date-local-getters',
        name: 'Local-time Date accessors',
        regex: /\b(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds)\s*\(\s*\)/g,
        tokens: ['getFullYear()', 'getMonth()', 'getDate()'],
        impact: 'HIGH',
        category: 'TIMEZONE',
        description:
          'Local Date getter accessors (getFullYear, getMonth, getDate) evaluate based on process-local timezone rather than UTC.',
        whyItMatters:
          'Timestamps near calendar or hour boundaries will resolve to different dates depending on the host or container timezone.'
      },
      {
        id: 'date-timezone-offset',
        name: 'Timezone offset calculation',
        regex: /\bgetTimezoneOffset\s*\(\s*\)/g,
        tokens: ['getTimezoneOffset()'],
        impact: 'MEDIUM',
        category: 'TIMEZONE',
        description: 'Code accesses getTimezoneOffset(), which varies directly by host environment timezone.',
        whyItMatters: 'Assertions assuming a fixed offset will fail in differing regional environments.'
      },
      {
        id: 'date-locale-format',
        name: 'Locale-dependent date formatting',
        regex: /\b(toLocaleDateString|toLocaleTimeString|toLocaleString)\s*\(/g,
        tokens: ['toLocaleDateString()', 'toLocaleString()'],
        impact: 'MEDIUM',
        category: 'LOCALE',
        description: 'Locale-dependent formatting methods produce differing outputs depending on system locale and ICU data.',
        whyItMatters: 'Formatting strings may differ between workstations and CI containers without full ICU.'
      },
      {
        id: 'platform-check',
        name: 'Operating system / platform check',
        regex: /process\.platform\b|os\.platform\(\)|os\.type\(\)/g,
        tokens: ['process.platform', 'os.platform()'],
        impact: 'MEDIUM',
        category: 'PLATFORM',
        description: 'Code inspects host platform (e.g. win32 vs linux vs darwin).',
        whyItMatters: 'Branching logic based on OS platform can cause test suite divergence between local and CI runners.'
      },
      {
        id: 'process-env-access',
        name: 'Environment variable access',
        regex: /process\.env\.([A-Z0-9_]+)/g,
        tokens: ['process.env'],
        impact: 'LOW',
        category: 'ENV_VAR',
        description: 'Direct access to process.env configuration variables.',
        whyItMatters: 'Undeclared or missing environment variables in CI will evaluate to undefined.'
      },
      {
        id: 'child-process-exec',
        name: 'Child process command execution',
        regex: /\b(exec|execSync|spawn|spawnSync)\s*\(/g,
        tokens: ['exec()', 'spawn()'],
        impact: 'LOW',
        category: 'PROCESS',
        description: 'Subprocess execution invokes host shell or system binaries.',
        whyItMatters: 'Binary availability, path separators, and shell syntax differ across operating systems.'
      }
    ];

    // Read and scan candidate files (capped at 100 files for fast static analysis)
    const filesToScan = filesToInspect.slice(0, 100);
    const patternMatches = new Map();

    for (const relPath of filesToScan) {
      scannedFilesCount++;
      const fullPath = repoDir ? path.join(repoDir, relPath) : null;
      let content = '';

      if (fullPath && fs.existsSync(fullPath)) {
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          continue;
        }
      }

      if (!content) continue;

      for (const pat of patterns) {
        pat.regex.lastIndex = 0;
        const match = pat.regex.exec(content);
        if (match) {
          flaggedFiles.add(relPath);
          if (!patternMatches.has(pat.id)) {
            patternMatches.set(pat.id, {
              pattern: pat,
              file: relPath,
              lineContent: '',
              lineNumber: 1,
              matchedToken: match[0],
              fullContent: content
            });

            // Calculate line number
            const lines = content.slice(0, match.index).split('\n');
            const lineNumber = lines.length;
            const allLines = content.split('\n');
            const lineContent = allLines[lineNumber - 1] || '';

            patternMatches.get(pat.id).lineNumber = lineNumber;
            patternMatches.get(pat.id).lineContent = lineContent.trim();
          }
        }
      }
    }

    // Convert pattern matches into structured findings
    for (const [, matchData] of patternMatches) {
      const { pattern: pat, file, lineNumber, lineContent, matchedToken } = matchData;

      findings.push({
        id: `code-${pat.id}`,
        type: 'OBSERVED_FACT',
        impact: pat.impact,
        title: `${pat.name} detected in ${file}:${lineNumber}`,
        description: pat.description,
        location: `${file}:${lineNumber}`,
        evidence: lineContent || matchedToken
      });

      evidence.push({
        type: 'ast-inspection',
        source: `${file}:${lineNumber}`,
        description: pat.description,
        technicalValues: [pat.tokens[0] || matchedToken, `${file}:${lineNumber}`]
      });

      // Prefer date local getters or primary failure file for code inspection snippet
      if (
        !codeInspection ||
        pat.id === 'date-local-getters' ||
        file.toLowerCase().includes('invoice') ||
        file.toLowerCase().includes('date')
      ) {
        codeInspection = this.buildCodeSnippet(matchData);
      }
    }

    // Correlation with user error or CI log
    const lowerError = (errorDescription + ' ' + ciLog).toLowerCase();
    if (lowerError.includes('date') || lowerError.includes('timezone') || lowerError.includes('utc')) {
      const dateMatch = patternMatches.get('date-local-getters');
      if (dateMatch) {
        findings.push({
          id: 'code-date-tz-correlation',
          type: 'INFERRED_RELATIONSHIP',
          impact: 'HIGH',
          title: `Calendar date resolution correlates with reported error in ${dateMatch.file}`,
          description: `User reported failure mentions date/timezone, and ${dateMatch.file} invokes local date accessors (${dateMatch.matchedToken}).`,
          location: `${dateMatch.file}:${dateMatch.lineNumber}`,
          evidence: dateMatch.lineContent
        });
      }
    }

    // Missing evidence check
    if (patternMatches.size === 0) {
      missingEvidence.push({
        description: 'No obvious environment-sensitive Date or platform patterns found in scanned source files.',
        whyItMatters:
          'Failure may be driven by configuration, network services, external databases, or third-party dependencies.'
      });
    }

    return {
      agent: 'Code',
      label: 'Code Agent',
      status: 'COMPLETE',
      focus: 'Code paths involved in environment or date resolution',
      runAt: new Date().toISOString(),
      scannedFilesCount,
      flaggedFiles: Array.from(flaggedFiles),
      findings,
      evidence,
      missingEvidence,
      codeInspection
    };
  }

  /**
   * Formats a code snippet context window around a matched line.
   */
  buildCodeSnippet(matchData) {
    const { file, lineNumber, fullContent, pattern } = matchData;
    if (!fullContent) return null;

    const allLines = fullContent.split('\n');
    const start = Math.max(0, lineNumber - 4);
    const end = Math.min(allLines.length, lineNumber + 4);

    const snippetLines = [];
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const isTarget = lineNum === lineNumber;
      snippetLines.push({
        lineNumber: lineNum,
        content: allLines[i],
        highlight: isTarget ? 'highlight' : 'normal'
      });
    }

    return {
      filename: file,
      description: `Static pattern analysis identified ${pattern.name} at line ${lineNumber}.`,
      lines: snippetLines,
      highlightedTokens: pattern.tokens
    };
  }

  /**
   * Helper to collect files recursively up to a reasonable depth.
   */
  collectFiles(dir, baseDir, ignoredDirs, allowedExts, depth = 0) {
    if (depth > 6) return [];
    let results = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.nvmrc' && entry.name !== '.node-version') continue;
        if (ignoredDirs.includes(entry.name)) continue;

        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(this.collectFiles(full, baseDir, ignoredDirs, allowedExts, depth + 1));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.has(ext)) {
            results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
          }
        }
      }
    } catch {
      // Ignore directory read errors
    }
    return results;
  }
}

module.exports = new CodeInvestigator();
