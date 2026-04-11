import { useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for infinite scroll functionality
 * Supports both window-based and container-based scrolling
 *
 * @param {Function} callback - Function to call when scroll reaches end
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether infinite scroll is enabled (default: true)
 * @param {boolean} options.isLoading - Whether data is currently loading (default: false)
 * @param {HTMLElement} options.containerRef - Reference to container element for container-based scroll (optional)
 * @param {number} options.threshold - Distance from bottom to trigger load (default: 100)
 */
export const useInfiniteScroll = (callback, options = {}) => {
  const {
    enabled = true,
    isLoading = false,
    containerRef = null,
    threshold = 100,
  } = options;

  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const handleScroll = useCallback(() => {
    if (!enabled || isLoading) return;

    let scrollTop, scrollHeight, clientHeight;

    if (containerRef && containerRef.current) {
      // Container-based scrolling
      const container = containerRef.current;
      scrollTop = container.scrollTop;
      scrollHeight = container.scrollHeight;
      clientHeight = container.clientHeight;
    } else {
      // Window-based scrolling (fallback)
      scrollTop = window.scrollY || document.documentElement.scrollTop;
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = document.documentElement.clientHeight;
    }

    // Check if we've reached near the end
    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      callbackRef.current();
    }
  }, [enabled, isLoading, containerRef, threshold]);

  useEffect(() => {
    if (!enabled || isLoading) return;

    if (containerRef && containerRef.current) {
      // Container-based scroll listener
      const container = containerRef.current;
      container.addEventListener("scroll", handleScroll);

      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    } else {
      // Window-based scroll listener
      window.addEventListener("scroll", handleScroll);

      return () => {
        window.removeEventListener("scroll", handleScroll);
      };
    }
  }, [handleScroll, enabled, isLoading, containerRef]);

  return useRef(null);
};

export default useInfiniteScroll;
