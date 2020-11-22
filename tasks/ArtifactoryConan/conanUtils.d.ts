// conanUtils.d.ts
// tslint:disable-next-line:no-namespace
declare namespace conan_utils {
    function getCliPartialsBuildDir(buildName: string, buildNumber: string): string;
}
export = conan_utils;
