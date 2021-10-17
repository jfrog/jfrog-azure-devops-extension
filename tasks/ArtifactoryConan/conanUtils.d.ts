// conanUtils.d.ts
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace conan_utils {
    function getCliPartialsBuildDir(buildName: string, buildNumber: string): string;
}
export = conan_utils;
