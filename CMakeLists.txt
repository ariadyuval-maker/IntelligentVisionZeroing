cmake_minimum_required(VERSION 3.14)
project(IntelligentVisionZeroing LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenCV REQUIRED)

add_executable(cold_zero main.cpp)

target_include_directories(cold_zero PRIVATE ${OpenCV_INCLUDE_DIRS})
target_link_libraries(cold_zero PRIVATE ${OpenCV_LIBS})
