import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import ci from 'ci-info';
import getRepoInfo from 'git-repo-info';
import { createUnplugin } from 'unplugin';

import type { Options } from './types';

import { getRepoUrl } from './repo';

export * from './types';

export const UnpluginInfo = createUnplugin<Options | undefined>((option) => {
  const now = new Date();

  const root = path.resolve(option?.root ?? process.cwd());
  const info = getRepoInfo(root);
  const github = option?.github ?? getRepoUrl(info, root);

  const ModuleName = {
    BuildTime: `${option?.prefix ?? '~build'}/time`,
    BuildInfo: `${option?.prefix ?? '~build'}/info`,
    BuildMeta: `${option?.prefix ?? '~build'}/meta`,
    BuildPackage: `${option?.prefix ?? '~build'}/package`
  };
  return {
    name: 'unplugin-info',
    resolveId(id) {
      if (
        ModuleName.BuildTime === id ||
        ModuleName.BuildInfo === id ||
        ModuleName.BuildMeta === id ||
        ModuleName.BuildPackage === id
      )
        return `\0${id}`;
    },
    async load(id) {
      if (!id.startsWith('\0')) return;
      id = id.slice(1);
      if (id === ModuleName.BuildTime) {
        return `const time = new Date(${now.getTime()})\n` + 'export default time';
      } else if (id === ModuleName.BuildInfo) {
        if (!info.root || !info.commonGitDir || !info.worktreeGitDir)
          this.warn('This may not be a git repo');

        const gen = (key: keyof typeof info) => {
          return `export const ${key} = ${JSON.stringify(info[key])}`;
        };

        return [
          `export const CI = ${ci.isCI ? `"${ci.name}"` : 'null'}`,
          `export const github = ${JSON.stringify(github ?? null)}`,
          gen('sha'),
          gen('abbreviatedSha'),
          gen('branch'),
          gen('tag'),
          gen('committer'),
          gen('committerDate'),
          gen('commitMessage'),
          gen('author'),
          gen('authorDate'),
          gen('lastTag'),
          gen('commitsSinceLastTag')
        ].join('\n');
      } else if (id === ModuleName.BuildMeta) {
        const body = Object.entries(option?.meta ?? {}).map(
          ([key, value]) => `export const ${key} = ${JSON.stringify(value, null, 2)};`
        );
        return body.join('\n');
      } else if (id === ModuleName.BuildPackage) {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
        const entries = Object.entries({
          name: '',
          version: '0.0.0',
          description: '',
          keywords: [],
          license: '',
          author: '',
          ...pkg
        }).filter(([key]) =>
          ['name', 'version', 'description', 'keywords', 'license', 'author'].includes(key)
        );
        return entries
          .map(([key, value]) => `export const ${key} = ${JSON.stringify(value, null, 2)};`)
          .join('\n');
      }
    }
  };
});
