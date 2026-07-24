// Content classification for FocusBro Rank System
// Distinguishes Coding / Serious Academic Study from general Edutainment / Infotainment.

// Explicit Whitelist for Coding & Learning Platforms (Always Awarded)
const CODING_STUDY_DOMAINS = [
  'leetcode.com',
  'codeforces.com',
  'geeksforgeeks.org',
  'github.com',
  'stackoverflow.com',
  'stackexchange.com',
  'w3schools.com',
  'developer.mozilla.org',
  'docs.python.org',
  'docs.oracle.com',
  'hackerrank.com',
  'codewars.com',
  'coursera.org',
  'udemy.com',
  'edx.org',
  'khanacademy.org',
  'nptel.ac.in',
  'mit.edu',
  'stanford.edu',
  'harvard.edu',
  'replit.com',
  'codepen.io',
  'codesandbox.io',
  'unacademy.com',
  'byjus.com',
  'physicswallah.live',
  'pw.live',
  'duolingo.com',
  'kaggle.com',
  'medium.com',
  'dev.to'
];

// Explicit Blacklist for Infotainment / General Curiosity YouTube Channels and Topics
// User requirement: "suppose they watch facttech or drhuv rathi that doesnt count in education"
const INFOTAINMENT_EXCLUSIONS = [
  'facttechz',
  'facttech',
  'dhruv rathee',
  'mohak mangal',
  'getsetfly',
  'nitish rajput',
  'soch by mohak',
  'vlog',
  'vlogs',
  'funny',
  'prank',
  'roast',
  'movie',
  'trailer',
  'teaser',
  'music',
  'song',
  'gaming',
  'gameplay',
  'reaction',
  'podcast',
  'news',
  'gossip',
  'shorts',
  'reels',
  'comedy',
  'standup'
];

// Keywords indicating genuine coding, software engineering, or academic study
const STUDY_CODING_KEYWORDS = [
  'leetcode',
  'codeforces',
  'dsa',
  'data structure',
  'algorithm',
  'coding',
  'programming',
  'python',
  'javascript',
  'typescript',
  'java',
  'c++',
  'cpp',
  'react',
  'node',
  'express',
  'sql',
  'database',
  'compiler',
  'system design',
  'web development',
  'frontend',
  'backend',
  'fullstack',
  'lecture',
  'tutorial',
  'course',
  'exam',
  'unit test',
  'problem solving',
  'revision',
  'one shot',
  'jee',
  'neet',
  'gate',
  'calculus',
  'physics',
  'chemistry',
  'biology',
  'mathematics',
  'computer science',
  'engineering',
  'class 10',
  'class 11',
  'class 12',
  'board exam',
  'study with me',
  'study vlog',
  'solution walkthrough',
  'mock test',
  'paper solution'
];

export interface ClassificationResult {
  isStudy: boolean;
  reason: string;
  matchedTerm?: string;
}

export function classifyContent(url: string, pageTitle: string): ClassificationResult {
  if (!url) {
    return { isStudy: false, reason: 'No active URL' };
  }

  const cleanUrl = url.toLowerCase();
  const cleanTitle = (pageTitle || '').toLowerCase();
  const combined = `${cleanUrl} ${cleanTitle}`;

  // 1. Check for Infotainment / General Curiosity Blacklist Exclusions FIRST
  for (const exclusion of INFOTAINMENT_EXCLUSIONS) {
    if (combined.includes(exclusion)) {
      return {
        isStudy: false,
        reason: `Excluded infotainment/general content: "${exclusion}"`,
        matchedTerm: exclusion
      };
    }
  }

  // 2. Check Whitelisted Coding & Academic Domains
  for (const domain of CODING_STUDY_DOMAINS) {
    if (cleanUrl.includes(domain)) {
      return {
        isStudy: true,
        reason: `Whitelisted study domain (${domain})`,
        matchedTerm: domain
      };
    }
  }

  // 3. Check for Study / Coding Specific Keywords in Title or URL
  for (const kw of STUDY_CODING_KEYWORDS) {
    if (combined.includes(kw)) {
      return {
        isStudy: true,
        reason: `Matched study keyword ("${kw}")`,
        matchedTerm: kw
      };
    }
  }

  // 4. Default: Non-study content
  return {
    isStudy: false,
    reason: 'General browsing / non-study content'
  };
}
