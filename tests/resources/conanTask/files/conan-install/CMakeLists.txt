cmake_minimum_required(VERSION 3.5)

set(CMAKE_CXX_STANDARD 17)

project(testproj)

# If conan is being used, configure CMake to use conan for dependencies.
include(${CMAKE_BINARY_DIR}/conan_paths.cmake OPTIONAL)

add_subdirectory(src)