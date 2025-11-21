import Button from "./ui/Button";

export const ConfirmDialog = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
      <h3 className="text-lg font-semibold mb-4">Confirm Action</h3>
      <p className="text-gray-700 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button onClick={onCancel} variant="secondary">Cancel</Button>
        <Button onClick={onConfirm} variant="danger">Delete</Button>
      </div>
    </div>
  </div>
);