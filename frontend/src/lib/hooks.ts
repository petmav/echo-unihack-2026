"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export type DeviceType = "mobile" | "desktop";

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>("mobile");

  useEffect(() => {
    const checkDevice = () => {
      const isMobile =
        window.innerWidth < MOBILE_BREAKPOINT ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      setDeviceType(isMobile ? "mobile" : "desktop");
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return deviceType;
}
