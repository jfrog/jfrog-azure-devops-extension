cmake_minimum_required(VERSION 3.5)

project(MyHello CXX)

include(${CMAKE_BINARY_DIR}/conanbuildinfo.cmake)

add_library(hello hello.cpp)
