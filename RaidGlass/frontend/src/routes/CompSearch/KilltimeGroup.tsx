
import { useFormContext } from "react-hook-form";

import DurationInputGroup from '../../components/shared/DurationInputGroup'
import { ZH_CN } from '../../localization/zhCN';
import FormGroup from './FormGroup'


/**
 * Component to input a min/max-killtime
 */
export default function KilltimeGroup() {

    const form_methods = useFormContext();

    function set_values(values: { min?: number; max?: number }) {
        form_methods.setValue("killtime_min", values.min && values.min > 0 ? values.min : undefined)
        form_methods.setValue("killtime_max", values.max && values.max > 0 ? values.max : undefined)
    }

    ////////////////////////////
    // Render
    return (
        <FormGroup name={ZH_CN.comp.killtime} className="killtime-search">
            <DurationInputGroup onChange={set_values}/>
        </FormGroup>
    )
}
