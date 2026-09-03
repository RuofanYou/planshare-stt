import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";

const OP_OPTIONS = (
    <>
        <option value="eq">=</option>
        <option value="lt">&lt;</option>
        <option value="gt">&gt;</option>
        <option value="lte">≤</option>
        <option value="gte">≥</option>
    </>
);

interface CountFilterProps {
    fieldBase: `comp.role.${string}` | `comp.spec.${string}`;
    label: string;
    iconPath: string;
    classSlug: string;
}

export default function SearchCountInput({
    fieldBase,
    label,
    iconPath,
    classSlug,
}: CountFilterProps) {
    const id = useId();
    const { register } = useFormContext();
    const value = useWatch({ name: `${fieldBase}.count` });
    const empty = value === undefined || value === "";

    return (
        <div
            className={`count-input-group wow-border-${classSlug} ${empty ? "empty" : ""}`}
            role="group"
            aria-label={label}
        >
            <span className="count-input-name">
                <img src={iconPath} alt="" aria-hidden="true" />
                <span>{label}</span>
            </span>
            <span className="count-input-controls">
                <label className="count-input-sr-label" htmlFor={`${id}-op`}>
                    {label}比较方式
                </label>
                <select
                    id={`${id}-op`}
                    className="op-dropdown"
                    defaultValue="eq"
                    {...register(`${fieldBase}.op`)}
                >
                    {OP_OPTIONS}
                </select>
                <label className="count-input-sr-label" htmlFor={`${id}-count`}>
                    {label}人数
                </label>
                <input
                    id={`${id}-count`}
                    type="number"
                    className="count-number"
                    inputMode="numeric"
                    placeholder="-"
                    min={0}
                    {...register(`${fieldBase}.count`)}
                />
            </span>
        </div>
    );
}
