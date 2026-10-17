/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // RapidAPI responses are fetched server-side in the route handler, so no
  // client-side image/API allowlisting is required here.
};

export default nextConfig;
