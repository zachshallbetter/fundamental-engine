class Fundamental < Formula
  desc "Scaffold a Fundamental starter project (vanilla, React, or web-component)"
  homepage "https://fundamentalengine.com"
  url "https://registry.npmjs.org/@fundamental-engine/create/-/create-0.11.2.tgz"
  # Fill this in before publishing. You cannot compute it here; run one of:
  #   brew fetch --build-from-source HomebrewFormula/fundamental.rb
  #   curl -sL https://registry.npmjs.org/@fundamental-engine/create/-/create-0.11.2.tgz | shasum -a 256
  sha256 "TODO_RUN_brew_fetch_TO_FILL"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    output = shell_output("#{bin}/create-fundamental-engine --help 2>&1", 0)
    assert_match "fundamental", output.downcase
  end
end
