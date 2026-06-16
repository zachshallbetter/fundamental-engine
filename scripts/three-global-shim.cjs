// Three.js is loaded as a global on the no-build page (window.THREE). The bundle aliases the bare
// `three` import to this shim so the engine reuses the page's single THREE instance.
module.exports = window.THREE;
