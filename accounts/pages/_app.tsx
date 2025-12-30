import { useState, useEffect } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import "@/styles/globals.css";
import Header from '../components/Header';
import Head from "next/head";

function Loader() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        backgroundColor: '#d4af37', // golden accent
        zIndex: 9999,
        animation: 'loadingBar 1.2s infinite',
      }}
    >
      <style jsx>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleStart = () => setLoading(true);
    const handleComplete = () => setLoading(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW registered:", reg))
        .catch((err) => console.error("SW failed:", err));
    }
  }, []);

  return (
    <>
      <Head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.PNG" />

        {/* Favicon */}
        <link rel="icon" href="/Favicon.PNG" />

        {/* Title */}
        <title>BLOUDAN ACCOUNTS</title>

        {/* Meta Description */}
        <meta
          name="description"
          content="The all in one acvounting system for jewelery workshop."
        />
         <style>{`
    html, body {
      overscroll-behavior: none;
    }
  `}</style>
      </Head>
      {loading && <Loader />}
      <Header />
      <Component {...pageProps} />
    </>
  );
}
