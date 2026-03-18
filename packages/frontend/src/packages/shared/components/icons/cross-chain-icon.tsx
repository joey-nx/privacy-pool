interface CrossChainIconProps {
  className?: string;
}

export function CrossChainIcon({ className = "w-5 h-5" }: CrossChainIconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#FC5593" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.4285 1.71387L14.47 3.75531V7.09749L17.1055 4.46196L19.9925 7.34899L17.3834 9.95814H12.4285C11.3011 9.95814 10.3871 10.8721 10.3871 11.9996C10.3871 13.127 11.3011 14.041 12.4285 14.041H17.3573L19.9926 16.6763L17.1056 19.5634L14.47 16.9277V20.2439L12.4285 22.2853L10.3871 20.2439V16.9544L7.77817 19.5634L4.89114 16.6763L7.52644 14.041H4.18426L2.14282 11.9996L4.18426 9.95814H7.50037L4.89122 7.34899L7.77825 4.46196L10.3871 7.0708V3.75531L12.4285 1.71387Z"
        fill="white"
      />
    </svg>
  );
}
