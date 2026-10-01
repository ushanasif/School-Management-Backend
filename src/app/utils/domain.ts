const getSchoolSubdomain = (
  hostname: string
): string | null => {
  const normalizedHost = hostname
    .toLowerCase()
    .split(":")[0];

  const productionDomain = "sncmt.com";

  // Production:
  // abc.sncmt.com -> abc
  if (
    normalizedHost.endsWith(
      `.${productionDomain}`
    )
  ) {
    const subdomain = normalizedHost.slice(
      0,
      -(productionDomain.length + 1)
    );

    if (
      !subdomain ||
      subdomain === "www" ||
      subdomain.includes(".")
    ) {
      return null;
    }

    return subdomain;
  }

  // Development:
  // abc.localhost -> abc
  if (normalizedHost.endsWith(".localhost")) {
    const subdomain = normalizedHost.slice(
      0,
      -".localhost".length
    );

    if (
      !subdomain ||
      subdomain.includes(".")
    ) {
      return null;
    }

    return subdomain;
  }

  return null;
};

export const DomainUtils = {
  getSchoolSubdomain,
};