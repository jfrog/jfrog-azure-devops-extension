echo Build started ...
cd artifactory-tasks-utils
echo In path: %cd%
@echo off
IF EXIST "package-lock.json" (
    del /f package-lock.json
)

IF EXIST "%cd%\node_modules\" (
    rmdir /s /q %cd%\node_modules\
)

IF EXIST "*.tgz" (
  del /S *.tgz
)

call npm pack
cd ..
echo Back to path %cd%
@echo off
set list=ArtifactoryBuildPromotion ArtifactoryGenericDownload ArtifactoryGenericUpload ArtifactoryMaven ArtifactoryNpm ArtifactoryNuget ArtifactoryPublishBuildInfo
(for %%a in (%list%) do (
    cd tasks\%%a
    echo In path: %cd%
    IF EXIST "package-lock.json" (
        del /f package-lock.json
    )
    IF EXIST "%cd%\node_modules\" (
        rmdir /s /q %cd%\node_modules\
    )
    call npm install
    cd ..\..
    echo Back to path %cd%
))

cd tests
echo In path: %cd%
IF EXIST "package-lock.json" (
    del /f package-lock.json
)
IF EXIST "%cd%\node_modules\" (
    rmdir /s /q %cd%\node_modules\
)

call npm install