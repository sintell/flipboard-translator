function getGeneratedSrcDirs(rootDir) {
  return ["chrome", "firefox"].map((browser) => `${rootDir}/${browser}/src`);
}

module.exports = {
  getGeneratedSrcDirs,
};
