import { describe, expect, it } from 'bun:test';
import { parseGitHubUrl } from '../github';

describe('GitHub URL Parser', () => {
  it('should parse standard https URL', () => {
    const res = parseGitHubUrl('https://github.com/octocat/Hello-World');
    expect(res).toEqual({ owner: 'octocat', repo: 'Hello-World' });
  });

  it('should parse URL with .git extension', () => {
    const res = parseGitHubUrl('https://github.com/facebook/react.git');
    expect(res).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('should parse SSH git URL', () => {
    const res = parseGitHubUrl('git@github.com:vercel/next.js.git');
    expect(res).toEqual({ owner: 'vercel', repo: 'next.js' });
  });

  it('should parse shorthand owner/repo', () => {
    const res = parseGitHubUrl('Izume01/deployment-system');
    expect(res).toEqual({ owner: 'Izume01', repo: 'deployment-system' });
  });

  it('should return null for invalid URL', () => {
    const res = parseGitHubUrl('https://gitlab.com/foo/bar');
    expect(res).toBeNull();
  });
});
