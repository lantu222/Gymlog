/**
 * Set one `android/gradle.properties` entry, replacing the value prebuild
 * generated rather than adding a second line the parser ignores.
 */
function setGradleProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);

  if (existing) {
    existing.value = value;
    return properties;
  }

  properties.push({ type: 'property', key, value });
  return properties;
}

module.exports = { setGradleProperty };
