

export default interface Role {
    code: string
    id: number
    name: string
    specs: string[]
    spec_ids?: Array<number | null>
    metrics: string[]
    icon_path: string

}
