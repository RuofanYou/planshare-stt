/* Loads Constant Data from the API that is used on all pages. */
import { loadBootstrapData } from "../store/bootstrap";
import { useAppDispatch } from "../store/store_hooks";
import { useEffect } from "react";

export default function GlobalDataLoader() {
    const dispatch = useAppDispatch();

    // Constant Data
    useEffect(() => {
        dispatch(loadBootstrapData());
    }, [dispatch]);

    return null;
}
