export * from './types';
export * from './github';
export * from './streamer';
export * from './local';

export {
  streamGitHubTarball,
  streamGitHubTarball as streamGitHubRepoToGCS,
} from './streamer';
export {
  uploadLocalDirectory,
  uploadLocalDirectory as uploadLocalDirToGCS,
} from './local';
