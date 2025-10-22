type NetworkMismatchNoticeProps = {
  fullScreen?: boolean;
  className?: string;
};

// Network switching is handled automatically on wallet connection
// This component is disabled as it's no longer needed
const NetworkMismatchNotice = (_props: NetworkMismatchNoticeProps) => {
  return null;
};

export default NetworkMismatchNotice;
