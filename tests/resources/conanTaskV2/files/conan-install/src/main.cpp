#include <iostream>

#include <fmt/format.h>

int main() {
  std::string msg = fmt::format("{} + {} = {}", 1, 2, 3);

  std::cout << "Hello, World: " << msg << std::endl;
  return 0;
}