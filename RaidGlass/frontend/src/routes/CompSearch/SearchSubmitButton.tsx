import { useWatch } from "react-hook-form";
import { ZH_CN } from "../../localization/zhCN";


export default function SearchSubmitButton({ describedBy }: { describedBy?: string }) {

    // state to enable/disable the button
    const boss_name_slug = useWatch({name: "boss_name_slug"})

    return (
        <button
            type="submit"
            disabled={!boss_name_slug}
            aria-describedby={describedBy}
            className="search-submit-button rg-button rg-button-primary"
        >
            {ZH_CN.comp.submit}
        </button>
    )
}
