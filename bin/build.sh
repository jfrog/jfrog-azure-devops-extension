#!/bin/bash
echo Build started ...

declare -a libraries=("jfrog-utils" "conan-utils")

for i in "${libraries[@]}"
do
    cd $i
    echo In path: $(pwd)
    rm -rf package-lock.json
    rm -rf node_modules
    rm -rf *.tgz
    npm pack
    cd ..
done

echo In path: $(pwd)
declare -a arr=("tests" "ArtifactoryGenericUpload" "ArtifactoryGenericDownload" "ArtifactoryPublishBuildInfo" "ArtifactoryPromote" "ArtifactoryConan")

for i in "${arr[@]}"
do
    cd $i
    rm -rf package-lock.json
    rm -rf node_modules
    npm install
    cd ..
done

rm -rf jfrog-utils/node_modules
