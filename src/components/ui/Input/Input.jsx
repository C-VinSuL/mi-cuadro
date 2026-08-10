const Input = ({
    label,
    placeholder,
    type="text"
}) => {

    return(

        <div className="flex flex-col gap-2">

            <label className="font-medium">

                {label}

            </label>

            <input

                type={type}

                placeholder={placeholder}

                className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"

            />

        </div>

    )

}

export default Input