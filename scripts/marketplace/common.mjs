import path from 'node:path';

export const PACKAGE_ID_PATTERN = '[A-Za-z0-9._-]+';
export const PACKAGE_VERSION_PATTERN = '\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?';

export const PACKAGE_ID_RE = new RegExp(`^${PACKAGE_ID_PATTERN}$`);
export const PACKAGE_VERSION_RE = new RegExp(`^${PACKAGE_VERSION_PATTERN}$`);
export const PACKAGE_ARCHIVE_RE = new RegExp(`^(?<id>${PACKAGE_ID_PATTERN})-(?<version>${PACKAGE_VERSION_PATTERN})$`);

export const PACKAGE_ARCHIVE_EXTENSION = '.zip';

export function isValidPackageId(id) {
  return typeof id === 'string' && PACKAGE_ID_RE.test(id);
}

export function isValidPackageVersion(version) {
  return typeof version === 'string' && PACKAGE_VERSION_RE.test(version);
}

export function assertPackageId(id) {
  if (!isValidPackageId(id)) {
    throw new Error(`Invalid package id "${id}". Expected pattern ${PACKAGE_ID_RE}.`);
  }
  return id;
}

export function assertPackageVersion(version) {
  if (!isValidPackageVersion(version)) {
    throw new Error(`Invalid package version "${version}". Expected SemVer pattern ${PACKAGE_VERSION_RE}.`);
  }
  return version;
}

export function composeArchiveFileName(id, version) {
  return `${id}-${version}${PACKAGE_ARCHIVE_EXTENSION}`;
}

export function parseArchiveName(name) {
  const match = name.match(PACKAGE_ARCHIVE_RE);
  if (!match) {
    return null;
  }
  const { id, version } = match.groups;
  return { id, version };
}

export function parseArchiveFileName(fileName) {
  if (!fileName.endsWith(PACKAGE_ARCHIVE_EXTENSION)) {
    return null;
  }
  return parseArchiveName(fileName.slice(0, -PACKAGE_ARCHIVE_EXTENSION.length));
}

export function relativeToProject(projectRoot, targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(projectRoot, targetPath);
}
