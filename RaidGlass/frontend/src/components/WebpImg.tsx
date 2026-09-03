

import type { SyntheticEvent } from "react";

interface WebpImgProps {
    src: string

    [x: string]: any;
}

export default function WebpImg({src, onError, ...props} : WebpImgProps) {
    function handleError(event: SyntheticEvent<HTMLImageElement>) {
        event.currentTarget.style.opacity = "0";
        event.currentTarget.parentElement?.setAttribute("data-rg-image-error", "true");
        onError?.(event);
    }

    return (
        <picture className="rg-image-frame">
            <img src={src} {...props} onError={handleError} />
        </picture>
    );
};
