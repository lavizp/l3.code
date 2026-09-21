export function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[34rem] rounded-sm bg-paper px-4 py-2.5 text-[15px] whitespace-pre-wrap text-void">
        {text}
      </div>
    </div>
  )
}
